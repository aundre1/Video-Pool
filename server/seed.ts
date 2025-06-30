import { db } from "./db";
import { memberships, categories, users } from "@shared/schema";
import { hash } from "bcrypt";

async function seedDatabase() {
  console.log("Starting database seeding...");

  // Check if we already have data
  const existingMemberships = await db.select().from(memberships);
  if (existingMemberships.length > 0) {
    console.log("Database already has data, skipping seeding");
    return;
  }

  console.log("Seeding membership plans...");
  // Add default memberships
  await db.insert(memberships).values([
    {
      name: "Monthly",
      price: 3499, // $34.99
      billingCycle: "monthly",
      downloadLimit: 200,
      features: [
        { feature: "200 downloads per month", included: true },
        { feature: "Full HD quality videos", included: true },
        { feature: "Cancel anytime", included: true },
        { feature: "Basic support", included: true },
        { feature: "4K video content", included: false },
      ],
      isPopular: false
    },
    {
      name: "Quarterly",
      price: 9999, // $99.99
      billingCycle: "quarterly",
      downloadLimit: 250,
      features: [
        { feature: "250 downloads per month", included: true },
        { feature: "4K video content", included: true },
        { feature: "Priority downloads", included: true },
        { feature: "Priority support", included: true },
        { feature: "Early access to new content", included: true },
      ],
      isPopular: true
    },
    {
      name: "Annual",
      price: 29999, // $299.99
      billingCycle: "annual",
      downloadLimit: 300,
      features: [
        { feature: "300 downloads per month", included: true },
        { feature: "8K video content (where available)", included: true },
        { feature: "Bulk download capability", included: true },
        { feature: "24/7 priority support", included: true },
        { feature: "Custom requests (1 per quarter)", included: true },
      ],
      isPopular: false
    }
  ]);

  console.log("Seeding categories...");
  // Add default categories
  await db.insert(categories).values([
    { name: "Visuals", slug: "visuals", iconName: "Sparkles", itemCount: 0 },
    { name: "Transitions", slug: "transitions", iconName: "ArrowsUpFromLine", itemCount: 0 },
    { name: "Audio React", slug: "audio-react", iconName: "Waves", itemCount: 0 },
    { name: "3D Elements", slug: "3d-elements", iconName: "Cube", itemCount: 0 },
    { name: "Loops", slug: "loops", iconName: "Film", itemCount: 0 },
    { name: "Effects", slug: "effects", iconName: "Zap", itemCount: 0 }
  ]);

  console.log("Seeding admin user...");
  // Add admin user (password will be hashed)
  const hashedPassword = await hash("adminpass", 10);
  await db.insert(users).values({
    username: "admin",
    email: "admin@videopool.pro",
    password: hashedPassword,
    role: "admin",
  });

  console.log("Database seeding completed successfully!");
}

export { seedDatabase };

// For direct execution (this will work with ESM modules)
if (import.meta.url.endsWith(process.argv[1])) {
  seedDatabase()
    .then(() => {
      console.log("Seeding complete, exiting");
      process.exit(0);
    })
    .catch(error => {
      console.error("Error seeding database:", error);
      process.exit(1);
    });
}