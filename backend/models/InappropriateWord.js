const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const InappropriateWord = sequelize.define("InappropriateWord", {
  word: {type: DataTypes.STRING(255),allowNull: false,unique: true,},
  category: {type: DataTypes.ENUM("profanity","insult","threat","sexual","spam","alcohol"),allowNull: false,},
  weight: {type: DataTypes.INTEGER,allowNull: false,defaultValue: 40,},
  match: {type: DataTypes.ENUM("contains", "word"),allowNull: false,defaultValue: "contains",},
  createdBy: {type: DataTypes.INTEGER,allowNull: true,},
}, {
  timestamps: true,
});

module.exports = InappropriateWord;