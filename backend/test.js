require('dotenv').config();
const mongoose = require('mongoose');
const { detectTopics } = require('./services/llmService');
const SourceDocument = require('./models/sourceDocument');
const Project = require('./models/Project');

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
    
    // Find the latest project
    const latestProject = await Project.findOne().sort({ createdAt: -1 });
    if (!latestProject) {
      console.log("No projects found");
      return;
    }
    console.log(`Latest project ID: ${latestProject._id}`);
    console.log(`Title: ${latestProject.title}`);
    console.log(`Topics saved in DB: ${latestProject.topics.length}`);
    console.log(`Provider in DB: ${latestProject.generationProvider}`);
    
    // Find docs for this project
    const docs = await SourceDocument.find({ projectId: latestProject._id });
    console.log(`Docs found: ${docs.length}`);
    if (docs.length > 0) {
      console.log(`Doc 0 length: ${docs[0].extractedText?.length}`);
      console.log("First 200 chars:\n", docs[0].extractedText?.substring(0, 200));
    }
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

main();