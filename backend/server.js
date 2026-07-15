const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const sequelize = require("./database");
const path = require("path");
const fs = require("fs");

dotenv.config();

const app = express();

// 👈 แก้ตรงนี้
app.use(cors({
  origin: "*",
  credentials: false,
}));

app.use(express.json());

require("./models/User");
require("./models/Activity");
require("./models/Notification");
require("./models/JoinRequest");
require("./models/Report");
require("./models/ActivityReview");
require("./models/HostReview");
require("./models/Comment");
require("./models/OTP");
require("./models/Checkin")
require("./jobs/reminderJob");

app.use("/api/auth", require("./routes/auth"));
app.use("/api/activities", require("./routes/activities"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/join", require("./routes/join"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/report", require("./routes/report"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/review", require("./routes/review"));
app.use("/api/forgot", require("./routes/forgot"));

sequelize.authenticate()
  .then(() => console.log("MySQL connected"))
  .catch((err) => console.log(err));

sequelize.sync({ force: false })
  .then(() => console.log("Tables synced"))
  .catch((err) => console.log(err));

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});