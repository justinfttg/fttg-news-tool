import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend directory (where package.json is)
// Use override:true to ensure .env values take precedence over any empty shell env vars
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

import express from 'express';
import cors from 'cors';
import { authMiddleware } from './middleware/auth.middleware';
import { errorHandler } from './middleware/error-handler';

// API route handlers
import loginHandler from '../api/auth/login';
import registerHandler from '../api/auth/register';
import logoutHandler from '../api/auth/logout';
import projectCreateHandler from '../api/projects/create';
import projectListHandler from '../api/projects/list';
import projectInviteHandler from '../api/projects/invite';
import projectMembersHandler from '../api/projects/members';
import calendarScheduleHandler from '../api/calendar/schedule';
import {
  listHandler as calendarListHandler,
  createHandler as calendarCreateHandler,
  updateHandler as calendarUpdateHandler,
  deleteHandler as calendarDeleteHandler,
} from '../api/calendar/items';
import { feedHandler as newsFeedHandler, storyHandler as newsStoryHandler } from '../api/news/feed';
import { markedHandler, markedIdsHandler } from '../api/news/marked';
import newsFetcherHandler from '../cron/news-fetcher';
import newsTrendingHandler from '../api/news/trending';
import trendingUpdaterHandler from '../cron/trending-updater';
import {
  listHandler as audienceListHandler,
  createHandler as audienceCreateHandler,
  updateHandler as audienceUpdateHandler,
  deleteHandler as audienceDeleteHandler,
} from '../api/audience/profiles';
import { analyzeHandler as audienceAnalyzeHandler } from '../api/audience/analyze';
// Topic Proposal routes
import {
  listHandler as topicProposalListHandler,
  generateHandler as topicProposalGenerateHandler,
  previewClustersHandler,
} from '../api/topics/proposals';
import {
  getHandler as topicProposalGetHandler,
  updateHandler as topicProposalUpdateHandler,
  deleteHandler as topicProposalDeleteHandler,
} from '../api/topics/proposal-by-id';
import {
  getSettingsHandler as topicSettingsGetHandler,
  updateSettingsHandler as topicSettingsUpdateHandler,
} from '../api/topics/settings';
import topicGeneratorCronHandler from '../cron/topic-generator';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Public routes
app.post('/api/auth/login', loginHandler);
app.post('/api/auth/register', registerHandler);
app.post('/api/auth/logout', logoutHandler);

// Protected routes
app.post('/api/projects/create', authMiddleware, projectCreateHandler);
app.get('/api/projects/list', authMiddleware, projectListHandler);
app.post('/api/projects/invite', authMiddleware, projectInviteHandler);
app.get('/api/projects/members', authMiddleware, projectMembersHandler);

// Calendar routes
app.get('/api/calendar/items', authMiddleware, calendarListHandler);
app.post('/api/calendar/items', authMiddleware, calendarCreateHandler);
app.put('/api/calendar/items/:id', authMiddleware, calendarUpdateHandler);
app.delete('/api/calendar/items/:id', authMiddleware, calendarDeleteHandler);
app.post('/api/calendar/schedule', authMiddleware, calendarScheduleHandler);

// News routes
app.get('/api/news/feed', authMiddleware, newsFeedHandler);
app.get('/api/news/story/:id', authMiddleware, newsStoryHandler);
app.get('/api/news/trending', authMiddleware, newsTrendingHandler);
app.get('/api/news/marked', authMiddleware, markedHandler);
app.post('/api/news/marked', authMiddleware, markedHandler);
app.delete('/api/news/marked', authMiddleware, markedHandler);
app.get('/api/news/marked/ids', authMiddleware, markedIdsHandler);

// Audience routes
app.get('/api/audience/profiles', authMiddleware, audienceListHandler);
app.post('/api/audience/profiles', authMiddleware, audienceCreateHandler);
app.put('/api/audience/profiles/:id', authMiddleware, audienceUpdateHandler);
app.delete('/api/audience/profiles/:id', authMiddleware, audienceDeleteHandler);
app.post('/api/audience/analyze', authMiddleware, audienceAnalyzeHandler);

// Topic Proposal routes
app.get('/api/topics/proposals', authMiddleware, topicProposalListHandler);
app.post('/api/topics/proposals', authMiddleware, topicProposalGenerateHandler);
app.get('/api/topics/proposals/:id', authMiddleware, topicProposalGetHandler);
app.patch('/api/topics/proposals/:id', authMiddleware, topicProposalUpdateHandler);
app.delete('/api/topics/proposals/:id', authMiddleware, topicProposalDeleteHandler);
app.post('/api/topics/preview-clusters', authMiddleware, previewClustersHandler);
app.get('/api/topics/settings', authMiddleware, topicSettingsGetHandler);
app.put('/api/topics/settings', authMiddleware, topicSettingsUpdateHandler);

// Cron routes (auth handled inside handler — supports CRON_SECRET or admin JWT)
app.post('/api/cron/news-fetch', newsFetcherHandler);
app.post('/api/cron/trending-update', trendingUpdaterHandler);
app.post('/api/cron/topic-generator', topicGeneratorCronHandler);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`FTTG Backend running on port ${PORT}`);
});

export default app;
