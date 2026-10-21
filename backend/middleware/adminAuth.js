const User = require('../models/User');

const adminAuth = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'support'].includes(user.role)) {
      return res.status(403).json({ message: 'Access denied. Admin or Support privileges required.' });
    }
    req.adminUser = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error checking admin privileges' });
  }
};

actionExport = adminAuth; // or module.exports = adminAuth;
module.exports = adminAuth;
