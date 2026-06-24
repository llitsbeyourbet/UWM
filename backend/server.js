const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const sequelize = require("./database");
const path = require("path");
const fs = require("fs");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// สร้างโฟลเดอร์ uploads ถ้ายังไม่มี
const uploadsPath = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath);

// Serve รูปภาพ
app.use("/uploads", express.static(uploadsPath));

// Import models
require("./models/User");
require("./models/Activity");
require("./models/Notification");
require("./models/JoinRequest");
require("./models/Report");
require("./models/ActivityReview");
require("./models/HostReview");
require("./models/Comment");


// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/activities", require("./routes/activities"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/join", require("./routes/join"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/report", require("./routes/report"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/review", require("./routes/review"));

// เชื่อม DB และสร้าง table
sequelize.authenticate()
  .then(() => console.log("MySQL connected"))
  .catch((err) => console.log(err));

sequelize.sync({ alter: true })
  .then(() => console.log("Tables synced"))
  .catch((err) => console.log(err));

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});