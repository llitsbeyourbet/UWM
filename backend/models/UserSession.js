const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const UserSession = sequelize.define("UserSession", {
    userId: {type: DataTypes.INTEGER,allowNull: false,unique: true,},
    sessionId: {type: DataTypes.STRING(100), allowNull: false, unique: true,},
    lastSeenAt: {type: DataTypes.DATE,allowNull: false,},
    expiresAt: {type: DataTypes.DATE, allowNull: false,},
    revokedAt: {type: DataTypes.DATE,allowNull: true,defaultValue: null,},
});

module.exports = UserSession;