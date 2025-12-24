/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Chatbot` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `Creator` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ChatbotType" AS ENUM ('CREATOR', 'FRAMEWORK', 'DEEP_DIVE', 'ADVISOR_BOARD');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('ROLE', 'CHALLENGE', 'STAGE');

-- AlterTable
ALTER TABLE "Chatbot" ADD COLUMN     "allowAnonymous" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "type" "ChatbotType";

-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "socialLinks" JSONB;

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chatbot_Category" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chatbot_Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorited_Chatbots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorited_Chatbots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Category_type_idx" ON "Category"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Category_type_slug_key" ON "Category"("type", "slug");

-- CreateIndex
CREATE INDEX "Chatbot_Category_categoryId_idx" ON "Chatbot_Category"("categoryId");

-- CreateIndex
CREATE INDEX "Chatbot_Category_chatbotId_idx" ON "Chatbot_Category"("chatbotId");

-- CreateIndex
CREATE UNIQUE INDEX "Chatbot_Category_chatbotId_categoryId_key" ON "Chatbot_Category"("chatbotId", "categoryId");

-- CreateIndex
CREATE INDEX "Favorited_Chatbots_userId_idx" ON "Favorited_Chatbots"("userId");

-- CreateIndex
CREATE INDEX "Favorited_Chatbots_chatbotId_idx" ON "Favorited_Chatbots"("chatbotId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorited_Chatbots_userId_chatbotId_key" ON "Favorited_Chatbots"("userId", "chatbotId");

-- CreateIndex
CREATE UNIQUE INDEX "Chatbot_slug_key" ON "Chatbot"("slug");

-- CreateIndex
CREATE INDEX "Chatbot_slug_idx" ON "Chatbot"("slug");

-- CreateIndex
CREATE INDEX "Chatbot_isPublic_idx" ON "Chatbot"("isPublic");

-- CreateIndex
CREATE INDEX "Chatbot_isActive_idx" ON "Chatbot"("isActive");

-- CreateIndex
CREATE INDEX "Chatbot_type_idx" ON "Chatbot"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_slug_key" ON "Creator"("slug");

-- AddForeignKey
ALTER TABLE "Chatbot_Category" ADD CONSTRAINT "Chatbot_Category_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chatbot_Category" ADD CONSTRAINT "Chatbot_Category_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorited_Chatbots" ADD CONSTRAINT "Favorited_Chatbots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorited_Chatbots" ADD CONSTRAINT "Favorited_Chatbots_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
