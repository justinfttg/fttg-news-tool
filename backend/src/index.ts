import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
import newsFetcherHandler from '../cron/news-fetcher';
import newsTrendingHandler from '../api/news/trending';
import trendingUpdaterHandler from '../cron/trending-updater';

dotenv.config();

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

// Cron routes (auth handled inside handler — supports CRON_SECRET or admin JWT)
app.post('/api/cron/news-fetch', newsFetcherHandler);
app.post('/api/cron/trending-update', trendingUpdaterHandler);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`FTTG Backend running on port ${PORT}`);
});

export default app;
