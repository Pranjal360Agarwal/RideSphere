const amqp = require("amqplib");

let channel;
let connection;

async function connect() {
  try {
    connection = await amqp.connect(
      process.env.RABBITMQ_URL || "amqp://localhost"
    );
    channel = await connection.createChannel();
    console.log("Connected to RabbitMQ");
  } catch (error) {
    console.log("RabbitMQ connection error:", error);
    setTimeout(connect, 5000);
  }
}

async function subscribeToQueue(queueName, callback) {
  try {
    if (!channel) {
      console.log("Channel not available");
      return;
    }
    await channel.assertQueue(queueName);
    channel.consume(queueName, (msg) => {
      if (msg) {
        callback(JSON.parse(msg.content.toString()));
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.log("Error subscribing to queue:", error);
  }
}

async function publishToQueue(queueName, message) {
  try {
    if (!channel) {
      console.log("Channel not available");
      return;
    }
    await channel.assertQueue(queueName);
    channel.sendToQueue(queueName, Buffer.from(message));
  } catch (error) {
    console.log("Error publishing to queue:", error);
  }
}

module.exports = {
  connect,
  subscribeToQueue,
  publishToQueue,
};
