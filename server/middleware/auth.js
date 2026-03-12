module.exports = function requireAuth(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.redirect('/admin/login.html');
};
