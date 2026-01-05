const express = require("express");
const router = express.Router();
const userController = require("../controllers/captain.controller");
const authMiddleware = require("../middleware/authMiddleWare");

router.post("/register", userController.register);
router.post("/login", userController.login);
router.get("/logout", userController.logout);
router.get("/profile", authMiddleware.captainAuth, userController.profile);
router.patch(
  "/toggle-availability",
  authMiddleware.captainAuth,
  userController.toggleAvailability
);

module.exports = router;
