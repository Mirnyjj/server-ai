import { prisma } from "./prisma.js";

async function main() {
  const profile = await prisma.aiProfile.create({
    data: {
      name: "Test Instagram Agent",
      systemPrompt: null,
      persona: {},
      visualIdentity: {},
      writingStyle: {},
      contentStrategy: {},
      autonomousMode: true,
    },
  });

  console.log("AiProfile created:");
  console.log(`id: ${profile.id}`);
  console.log(`name: ${profile.name}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
