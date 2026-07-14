const cron = require("node-cron");

const Activity = require("../models/Activity");
const JoinRequest = require("../models/JoinRequest");
const Notification = require("../models/Notification");


// ทำงานทุก 1 นาที
cron.schedule("* * * * *", async () => {

  try {

    const now = new Date();

    // ดึงกิจกรรมที่ยัง active
    const activities = await Activity.findAll({
      where: {
        status: "active",
      },
    });


    for (const activity of activities) {


      // ถ้าไม่มีวันหรือเวลา ข้าม
      if (!activity.date || !activity.time) continue;


      // รวมวันที่กับเวลา
      const activityStart = new Date(
        `${activity.date}T${activity.time}:00`
      );


      // เวลาที่เหลือ (นาที)
      const diffMinutes = Math.floor(
        (activityStart - now) / 1000 / 60
      );


      console.log(
        activity.activityName,
        "เหลือ",
        diffMinutes,
        "นาที"
      );


      // แจ้งเตือนช่วงก่อนเริ่ม 59-60 นาที
      if (diffMinutes >= 59 && diffMinutes <= 60) {


        // หาเฉพาะคนที่เข้าร่วมแล้ว
        const members = await JoinRequest.findAll({
          where: {
            activityId: activity.id,
            status: "approved",
          },
        });



        for (const member of members) {


          // เช็กว่าเคยแจ้งเตือนหรือยัง
          const exists = await Notification.findOne({
            where: {
              type: "reminder",
              activityId: activity.id,
              toUserId: member.userId,
            },
          });



          if (!exists) {


            await Notification.create({

              type: "reminder",

              toUserId: member.userId,

              activityId: activity.id,

              activityName: activity.activityName,

              isRead: false,

            });


            console.log(
              "สร้าง Reminder ให้ User:",
              member.userId,
              "กิจกรรม:",
              activity.activityName
            );

          }

        }

      }

    }


  } catch (error) {

    console.log(
      "Reminder Job Error:",
      error.message
    );

  }

});