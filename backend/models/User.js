const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  password: {
    type: String,
    minlength: 8,
    maxlength: 72,
    select: false,
    // Not required — Google users have no password
  },
  googleId: { type: String, index: true, sparse: true },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  if (!this.password) return; // Google user without password
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (plain) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toJSON = function () {
  const o = this.toObject();
  return {
    _id: o._id, name: o.name, email: o.email,
    role: o.role, createdAt: o.createdAt, updatedAt: o.updatedAt,
    authProvider: o.authProvider,
  };
};

module.exports = mongoose.model('User', userSchema);