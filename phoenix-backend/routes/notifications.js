const express = require("express");

const router = express.Router();

router.post("/register-device", async (req, res) => {
  return res.json({
    ok: true,
    message: "notification route works",
  });
});

module.exports = router;