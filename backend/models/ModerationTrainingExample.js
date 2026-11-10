
const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const ModerationTrainingExample = sequelize.define(
  "ModerationTrainingExample",
  {
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    category: {
      type: DataTypes.ENUM(
        "profanity",
        "insult",
        "sexual",
        "spam"
      ),
      allowNull: false,
    },

    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    trainingJobId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(
        "waiting",
        "queued",
        "completed"
      ),
      allowNull: false,
      defaultValue: "waiting",
    },
  },
  {
    timestamps: true,
    indexes: [
      {
        fields: ["status", "createdAt"],
      },
      {
        fields: ["trainingJobId"],
      },
    ],
  }
);

module.exports = ModerationTrainingExample;
