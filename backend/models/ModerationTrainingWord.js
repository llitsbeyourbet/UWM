const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const ModerationTrainingWord = sequelize.define('ModerationTrainingWord', {
  wordId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  trainingJobId: { type: DataTypes.INTEGER, allowNull: false },
  wordSnapshot: { type: DataTypes.STRING(255), allowNull: false },
  categorySnapshot: {
    type: DataTypes.ENUM('profanity', 'insult', 'sexual', 'spam'),
    allowNull: false,
  },
}, { timestamps: true });

module.exports = ModerationTrainingWord;
