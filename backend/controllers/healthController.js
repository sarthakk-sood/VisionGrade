const getHealth = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Vision Grade backend is running',
    timestamp: new Date().toISOString(),
  });
};

module.exports = { getHealth };