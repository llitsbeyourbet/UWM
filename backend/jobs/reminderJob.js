const Activity = require("../models/Activity");
const JoinRequest = require("../models/JoinRequest");
const Notification = require("../models/Notification");

async function checkReminder() {
  try {
    const now = new Date();

    // ดึงกิจกรรมที่ยัง Active
    const activities = await Activity.findAll({
      where: {
        status: "active",
      },
    });

    for (const activity of activities) {

      if (!activity.date || !activity.time) continue;

      // รองรับทั้ง HH:mm และ HH:mm:ss
      const time =
        activity.time.length === 5
          ? `${activity.time}:00`
          : activity.time;

      // สร้างวันเวลาเริ่มกิจกรรม
      const activityStart = new Date(`${activity.date}T${time}+07:00`);

      if (isNaN(activityStart.getTime())) {
        console.log(
          "Invalid Date:",
          activity.activityName,
          activity.date,
          activity.time
        );
        continue;
      }

      // เวลาที่เหลือ (นาที)
      const diffMinutes = Math.floor(
        (activityStart.getTime() - now.getTime()) / 1000 / 60
      );

      console.log(
        `[Reminder] ${activity.activityName} | เหลือ ${diffMinutes} นาที`
      );

      // แจ้งเตือนเมื่อเหลือไม่เกิน 60 นาที
      if (diffMinutes >= 0 && diffMinutes <= 60) {

        const members = await JoinRequest.findAll({
          where: {
            activityId: activity.id,
            status: "approved",
          },
        });

        for (const member of members) {

          // กันแจ้งเตือนซ้ำ
          const exists = await Notification.findOne({
            where: {
              type: "reminder",
              activityId: activity.id,
              toUserId: member.userId,
            },
          });

          if (exists) continue;

          await Notification.create({
            type: "reminder",
            toUserId: member.userId,
            activityId: activity.id,
            activityName: activity.activityName,
            isRead: false,
          });

          console.log(
            `สร้าง Reminder -> User ${member.userId} | ${activity.activityName}`
          );
        }
      }
    }

  } catch (error) {
    console.log("Reminder Job Error:", error.message);
  }
}

// ตรวจทันทีเมื่อเปิด Server
checkReminder();

// ตรวจทุก 1 นาที
setInterval(checkReminder, 60000);