const router = require("express").Router();
const { issueSession } = require("../middleware/sessionAuth");

router.post("/", (_req, res) => {
  res.json({ success: true, sessionId: issueSession() });
});

module.exports = router;
