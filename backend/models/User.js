const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const User = sequelize.define("User", {
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  profileImage: { type: DataTypes.STRING, defaultValue: null },
  phone: { type: DataTypes.STRING },
  birthdate: { type: DataTypes.STRING },
  bio: { type: DataTypes.TEXT },
  role: {type: DataTypes.ENUM("user","admin"),defaultValue:"user"}
});

module.exports = User;