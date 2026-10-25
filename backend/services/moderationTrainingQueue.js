// จัดกลุ่มคำใหม่เป็นรอบละ 10 คำ ยังไม่สั่งฝึกโมเดลจริง
const { QueryTypes, Op } = require("sequelize");
const sequelize = require("../database");
const InappropriateWord = require("../models/InappropriateWord");
const ModerationTrainingJob = require("../models/ModerationTrainingJob");
const ModerationTrainingWord = require("../models/ModerationTrainingWord");

const BATCH_SIZE = 10;
const TRAINABLE = ["profanity", "insult", "sexual", "spam"];
const LOCK_NAME = "uwm_moderation_training_queue_v1";

function getStartDate() {
  const raw = process.env.MODERATION_TRAINING_START_AT;
  if (!raw) return null; // ไม่ย้อนนับคำเก่าโดยไม่ตั้งใจ
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid MODERATION_TRAINING_START_AT; use ISO 8601 UTC date");
  }
  return date;
}

async function findUnassigned(startAt, transaction, limit) {
  const assigned = await ModerationTrainingWord.findAll({
    attributes: ["wordId"], raw: true, transaction,
  });
  const assignedIds = assigned.map(x => x.wordId);
  const where = {
    category: { [Op.in]: TRAINABLE },
    createdAt: { [Op.gte]: startAt },
  };
  if (assignedIds.length) where.id = { [Op.notIn]: assignedIds };
  return InappropriateWord.findAll({
    where, order: [["createdAt", "ASC"], ["id", "ASC"]],
    ...(limit ? { limit } : {}), transaction,
  });
}

async function queueTrainingJobs() {
  const startAt = getStartDate();
  if (!startAt) return { enabled: false, createdJobs: 0 };
  // ใช้ MySQL named lock ป้องกันการเพิ่มคำพร้อมกันสร้างรอบฝึกซ้อนกัน
  return sequelize.transaction(async transaction => {
    const rows = await sequelize.query("SELECT GET_LOCK(:name, 10) AS acquired", {
      replacements: { name: LOCK_NAME }, type: QueryTypes.SELECT, transaction,
    });
    if (Number(rows[0]?.acquired) !== 1) throw new Error("Training queue lock timeout");
    try {
      let createdJobs = 0;
      while (true) {
        const words = await findUnassigned(startAt, transaction, BATCH_SIZE);
        if (words.length < BATCH_SIZE) break;
        const job = await ModerationTrainingJob.create({ status: "pending" }, { transaction });
        await ModerationTrainingWord.bulkCreate(words.map(item => ({
          wordId: item.id,
          trainingJobId: job.id,
          wordSnapshot: item.word,
          categorySnapshot: item.category,
        })), { transaction });
        createdJobs += 1;
      }
      return { enabled: true, createdJobs };
    } finally {
      await sequelize.query("SELECT RELEASE_LOCK(:name) AS released", {
        replacements: { name: LOCK_NAME }, type: QueryTypes.SELECT, transaction,
      });
    }
  });
}

async function getTrainingQueueStatus() {
  const startAt = getStartDate();
  if (!startAt) return {
    enabled: false, reason: "Set MODERATION_TRAINING_START_AT",
    batchSize: BATCH_SIZE, waitingWords: 0, jobs: [],
  };
  const [waiting, jobs] = await Promise.all([
    findUnassigned(startAt),
    ModerationTrainingJob.findAll({ order: [["createdAt", "DESC"]], limit: 20, raw: true }),
  ]);
  return {
    enabled: true, batchSize: BATCH_SIZE, waitingWords: waiting.length,
    wordsUntilNextJob: Math.max(0, BATCH_SIZE - waiting.length), jobs,
  };
}

module.exports = { queueTrainingJobs, getTrainingQueueStatus };
