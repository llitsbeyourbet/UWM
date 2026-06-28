const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const OTP = sequelize.define("OTP", {
  email: { type: DataTypes.STRING, allowNull: false },
  otp: { type: DataTypes.STRING, allowNull: false },
  expiredAt: { type: DataTypes.DATE, allowNull: false },
});

module.exports = OTP;