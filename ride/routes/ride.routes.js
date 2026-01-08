const express = require("express");
const router = express.Router();
const rideController = require("../controller/ride.controller");

router.post("/create-ride", rideController.createRide);
router.put("/accept-ride", rideController.acceptRide);

module.exports = router;
