const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const ModerationTrainingJob = sequelize.define('ModerationTrainingJob', {
  status: {
    type: DataTypes.ENUM('pending', 'preparing', 'training', 'evaluating', 'completed', 'failed'),
    allowNull: false,
    defaultValue: 'pending',
  },
  modelVersion: { type: DataTypes.STRING(100), allowNull: true },
  errorMessage: { type: DataTypes.TEXT, allowNull: true },
  startedAt: { type: DataTypes.DATE, allowNull: true },
  finishedAt: { type: DataTypes.DATE, allowNull: true },
}, { timestamps: true });

module.exports = ModerationTrainingJob;
