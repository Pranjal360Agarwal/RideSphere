const userModel = require("../models/user.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Example: User registration
module.exports.registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body; // Get user details from request body
    const user = await userModel.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }
    // Hash the password before saving
    const hash = await bcrypt.hash(password, 10);
    const newUser = new userModel({ name, email, password: hash });
    await newUser.save();
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
