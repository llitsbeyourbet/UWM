const cron = require("node-cron");

const Activity = require("../models/Activity");
const JoinRequest = require("../models/JoinRequest");
const Notification = require("../models/Notification");


// ทำงานทุก 1 นาที
cron.schedule("* * * * *", async () => {

  try {

    const now = new Date();


    const activities = await Activity.findAll({
      where: {
        status: "active",
      },
    });


    for (const activity of activities) {


      if (!activity.date || !activity.time) continue;


      // แปลงวันที่ mm/dd/yy -> yyyy-mm-dd
      const [month, day, year] = activity.date.split("/");


      if (!month || !day || !year) {
        console.log("Date format error:", activity.date);
        continue;
      }


      // รองรับเวลา HH:mm หรือ HH:mm:ss
      const time = activity.time.length === 5
        ? `${activity.time}:00`
        : activity.time;


      // สร้างเวลาไทย
      const activityStart = new Date(
        `20${year}-${month}-${day}T${time}+07:00`
      );


      if (isNaN(activityStart)) {
        console.log(
          "Invalid date:",
          activity.date,
          activity.time
        );
        continue;
      }


      const diffMinutes = Math.floor(
        (activityStart - now) / 1000 / 60
      );


      console.log(
        activity.activityName,
        "เริ่ม:",
        activityStart,
        "เหลือ:",
        diffMinutes,
        "นาที"
      );



      // แจ้งเตือนก่อนเริ่มภายใน 1 ชั่วโมง
      if (diffMinutes <= 60 && diffMinutes >= 0) {


        const members = await JoinRequest.findAll({
          where: {
            activityId: activity.id,
            status: "approved",
          },
        });



        for (const member of members) {


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