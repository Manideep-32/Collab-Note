const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const asyncHandler = require('../util/asyncHandler')
const User = require('../models/User')
const { ROLES } = require('../util/constants')

const makeAvatarUrl = (seed) => {
  const safeSeed = encodeURIComponent(String(seed || 'collab-user').trim() || 'collab-user')
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${safeSeed}`
}

const createToken = (user) => {
  const secret = process.env.JWT_SECRET
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'

  return jwt.sign(
    {
      userId: user._id,
      role: user.role
    },
    secret,
    { expiresIn }
  )
}

const register = asyncHandler(async (req, res) => {
  const { fullName, email, password, role } = req.body
  console.log(`Registration attempt for ${email} with role ${role}`)

  if (!fullName || !email || !password) {
    return res.status(400).json({ message: 'fullName, email and password are required' })
  }

  if (String(password).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' })
  }

  const existingUser = await User.findOne({ email: String(email).toLowerCase() })
  if (existingUser) {
    console.log(`Registration failed: email ${email} already in use`)
    return res.status(409).json({ message: 'Email already in use' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  
  // Validate role if provided, otherwise default to USER
  let assignedRole = ROLES.USER
  if (role && Object.values(ROLES).includes(role.toUpperCase())) {
    assignedRole = role.toUpperCase()
  }
  console.log(`Assigning role: ${assignedRole}`)

  const user = await User.create({
    fullName,
    email,
    passwordHash,
    role: assignedRole,
    avatarUrl: makeAvatarUrl(email || fullName)
  })

  console.log(`Registration successful for ${email}`)
  const token = createToken(user)

  return res.status(201).json({
    message: 'Registration successful',
    token,
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl || ''
    }
  })
})

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  console.log(`Login attempt for ${email}`)

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' })
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  const user = await User.findOne({ email: normalizedEmail })
  if (!user) {
    console.log(`User not found: ${normalizedEmail}`)
    return res.status(404).json({ message: 'Account does not exist' })
  }

  if (!user.isActive) {
    console.log(`User inactive: ${normalizedEmail}`)
    return res.status(403).json({ message: 'Account is inactive' })
  }

  if (typeof user.passwordHash !== 'string' || !user.passwordHash) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  let isMatch = false
  try {
    isMatch = await bcrypt.compare(String(password), user.passwordHash)
  } catch (err) {
    console.log(`Compare error: ${err.message}`)
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  if (!isMatch) {
    console.log(`Wrong password for: ${normalizedEmail}`)
    return res.status(401).json({ message: 'Wrong password' })
  }

  console.log(`Login successful for: ${normalizedEmail}`)
  const token = createToken(user)

  return res.json({
    message: 'Login successful',
    token,
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      assignedSubjectIds: user.assignedSubjectIds,
      avatarUrl: user.avatarUrl || ''
    }
  })
})

const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-passwordHash')
  if (!user) {
    return res.status(404).json({ message: 'User not found' })
  }

  return res.json(user)
})

const updateMe = asyncHandler(async (req, res) => {
  const { fullName, email, currentPassword, newPassword, avatarUrl } = req.body

  const user = await User.findById(req.user.id)
  if (!user) {
    return res.status(404).json({ message: 'User not found' })
  }

  const normalizedEmail = email ? String(email).trim().toLowerCase() : ''

  if (normalizedEmail && normalizedEmail !== user.email) {
    const emailTaken = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: user._id }
    })

    if (emailTaken) {
      return res.status(409).json({ message: 'Email already in use' })
    }

    user.email = normalizedEmail
  }

  if (typeof fullName === 'string' && fullName.trim()) {
    user.fullName = fullName.trim()
  }

  if (typeof avatarUrl === 'string') {
    user.avatarUrl = avatarUrl.trim()
  }

  if (newPassword) {
    if (!currentPassword) {
      return res.status(400).json({ message: 'currentPassword is required to change password' })
    }

    const isMatch = await bcrypt.compare(String(currentPassword), user.passwordHash)
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' })
    }

    user.passwordHash = await bcrypt.hash(String(newPassword), 10)
  }

  await user.save()

  return res.json({
    message: 'Profile updated',
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      assignedSubjectIds: user.assignedSubjectIds,
      avatarUrl: user.avatarUrl || ''
    }
  })
})

const refresh = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
  if (!user || !user.isActive) {
    return res.status(401).json({ message: 'User not found or inactive' })
  }

  const token = createToken(user)

  return res.json({ token })
})

const bootstrapOwner = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body

  if (!fullName || !email || !password) {
    return res.status(400).json({ message: 'fullName, email and password are required' })
  }

  if (String(password).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' })
  }

  const ownerExists = await User.exists({ role: ROLES.OWNER })
  if (ownerExists) {
    return res.status(409).json({ message: 'Owner already exists. Use owner management endpoints.' })
  }

  const existingUser = await User.findOne({ email: String(email).toLowerCase() })
  if (existingUser) {
    return res.status(409).json({ message: 'Email already in use' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const owner = await User.create({
    fullName,
    email,
    passwordHash,
    role: ROLES.OWNER,
    avatarUrl: makeAvatarUrl(email || fullName)
  })

  const token = createToken(owner)

  return res.status(201).json({
    message: 'Owner account created',
    token,
    user: {
      id: owner._id,
      fullName: owner.fullName,
      email: owner.email,
      role: owner.role,
      avatarUrl: owner.avatarUrl || ''
    }
  })
})

module.exports = {
  register,
  login,
  me,
  updateMe,
  refresh,
  bootstrapOwner
}
