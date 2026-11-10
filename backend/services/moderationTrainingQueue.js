
const { Op, QueryTypes } = require("sequelize");
const sequelize = require("../database");
const ModerationTrainingJob = require("../models/ModerationTrainingJob");
const ModerationTrainingExample = require("../models/ModerationTrainingExample");

const BATCH_SIZE = 30;
const LOCK_NAME = "uwm_moderation_training_queue_v2";

async function findWaitingExamples(transaction, limit) {
  return ModerationTrainingExample.findAll({
    where: {
      status: "waiting",
      trainingJobId: null,
    },
    order: [
      ["createdAt", "ASC"],
      ["id", "ASC"],
    ],
    ...(limit ? { limit } : {}),
    transaction,
  });
}


async function queueTrainingJobs() {
  return sequelize.transaction(async (transaction) => {
    const rows = await sequelize.query(
      "SELECT GET_LOCK(:name, 10) AS acquired",
      {
        replacements: { name: LOCK_NAME },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    if (Number(rows[0]?.acquired) !== 1) {
      throw new Error("Training queue lock timeout");
    }

    try {
      let createdJobs = 0;

      while (true) {
        const examples = await findWaitingExamples(
          transaction,
          BATCH_SIZE
        );

        if (examples.length < BATCH_SIZE) break;

        const job = await ModerationTrainingJob.create(
          { status: "pending" },
          { transaction }
        );

        const ids = examples.map((example) => example.id);

        const [updatedCount] =
          await ModerationTrainingExample.update(
            {
              status: "queued",
              trainingJobId: job.id,
            },
            {
              where: {
                id: { [Op.in]: ids },
                status: "waiting",
                trainingJobId: null,
              },
              transaction,
            }
          );

        if (updatedCount !== ids.length) {
          throw new Error(
            "Training examples changed during queue creation"
          );
        }

        createdJobs += 1;
      }

      return {
        enabled: true,
        createdJobs,
      };
    } finally {
      await sequelize.query(
        "SELECT RELEASE_LOCK(:name) AS released",
        {
          replacements: { name: LOCK_NAME },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
    }
  });
}


async function getTrainingQueueStatus() {
  const [waitingWords, jobs] = await Promise.all([
    ModerationTrainingExample.count({
      where: {
        status: "waiting",
        trainingJobId: null,
      },
    }),
    ModerationTrainingJob.findAll({
      order: [["createdAt", "DESC"]],
      limit: 20,
      raw: true,
    }),
  ]);

  return {
    enabled: true,
    batchSize: BATCH_SIZE,
    waitingWords,
    waitingExamples: waitingWords,
    examplesUntilNextJob: Math.max(0, BATCH_SIZE - waitingWords),
    wordsUntilNextJob: Math.max(0, BATCH_SIZE - waitingWords),
    jobs,
  };
}

module.exports = {
  queueTrainingJobs,
  getTrainingQueueStatus,
};
