import express, { type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  clearSessionCookie,
  hashPassword,
  readSessionUser,
  requireAuth,
  setSessionCookie,
  verifyPassword,
  type AuthenticatedRequest,
} from "./lib/auth.js";
import { env } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import {
  DEFAULT_CONTRACT_SETTINGS,
  DEFAULT_REST_RULES,
  DEFAULT_ROLE,
  DEFAULT_WEEK_SETTINGS,
} from "./lib/defaults.js";
import { parseDateOnly } from "./lib/date.js";
import {
  serializeActivity,
  serializeActivityType,
  serializeContract,
  serializeDefaultWeek,
  serializeProfile,
  serializeRestDay,
  serializeRestRules,
  serializeUser,
  serializeVacation,
} from "./lib/serializers.js";
import { importBokuKumasala } from "./lib/import-boku-kumasala.js";

const app = express();

app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

const roleSchema = z.enum(["logisticien", "animateur", "manager"]);
const restStatusSchema = z.enum(["suggested", "validated", "rejected"]);
const restPeriodSchema = z.enum(["full_day", "morning", "afternoon"]);
const restKindSchema = z.enum(["regular", "sick"]);
const durationKindSchema = z.enum(["full_day", "morning", "afternoon", "custom"]);

const activityInputSchema = z.object({
  user_id: z.string().optional(),
  title: z.string().trim().min(1),
  activity_type: z.string().trim().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  location: z.string().default(""),
  notes: z.string().default(""),
  source: z.string().default("manual"),
  external_id: z.string().default(""),
  duration_kind: durationKindSchema.default("custom"),
  break_minutes: z.coerce.number().int().min(0).default(0),
});

const activityUpdateSchema = activityInputSchema.partial().extend({
  title: z.string().trim().min(1).optional(),
  activity_type: z.string().trim().min(1).optional(),
});

const restDayInputSchema = z.object({
  user_id: z.string().optional(),
  rest_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: restStatusSchema.default("suggested"),
  reason: z.string().default(""),
  rest_period: restPeriodSchema.default("full_day"),
  kind: restKindSchema.default("regular"),
});

const vacationInputSchema = z
  .object({
    user_id: z.string().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    label: z.string().default(""),
  })
  .refine((value) => value.end_date >= value.start_date, {
    message: "La date de fin doit être postérieure à la date de début.",
    path: ["end_date"],
  });

const settingsSchema = z.object({
  profile: z.object({
    full_name: z.string().default(""),
    role: roleSchema.default(DEFAULT_ROLE),
  }),
  contract: z.object({
    weekly_hours: z.coerce.number(),
    daily_max_hours: z.coerce.number(),
    min_rest_hours: z.coerce.number(),
    overtime_rate: z.coerce.number(),
  }),
  rules: z.object({
    preferred_rest_days: z.array(z.number().int().min(1).max(7)),
    preferred_time_of_day: z.string().default("any"),
    min_consecutive_rest_days: z.coerce.number().int().min(1).default(1),
    auto_suggest: z.boolean(),
  }),
  defaultWeek: z.object({
    rest_days: z.array(z.number().int().min(1).max(7)),
    default_title: z.string().default("Travail"),
    default_type: z.string().default("prestation"),
    morning_start: z.string().regex(/^\d{2}:\d{2}$/),
    morning_end: z.string().regex(/^\d{2}:\d{2}$/),
    afternoon_start: z.string().regex(/^\d{2}:\d{2}$/),
    afternoon_end: z.string().regex(/^\d{2}:\d{2}$/),
    pause_start: z.string().regex(/^\d{2}:\d{2}$/),
    pause_end: z.string().regex(/^\d{2}:\d{2}$/),
    break_minutes: z.coerce.number().int().min(0),
  }),
});

function sendZodError(res: Response, error: z.ZodError) {
  const issue = error.issues[0];
  res.status(400).json({ error: issue?.message ?? "Invalid payload" });
}

function handleError(res: Response, error: unknown) {
  if (error instanceof z.ZodError) {
    sendZodError(res, error);
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({ error: "Cette ressource existe déjà." });
      return;
    }
  }

  const message = error instanceof Error ? error.message : "Unexpected server error";
  res.status(500).json({ error: message });
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/auth/session", (req, res) => {
  const user = readSessionUser(req);
  res.json({
    session: user ? { user: serializeUser(user) } : null,
  });
});

app.post("/api/auth/sign-up", async (req, res) => {
  try {
    const payload = z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        full_name: z.string().trim().min(1),
      })
      .parse(req.body);

    const email = payload.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Un compte existe déjà avec cet email." });
      return;
    }

    const passwordHash = await hashPassword(payload.password);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
        },
      });

      await tx.profile.create({
        data: {
          id: createdUser.id,
          fullName: payload.full_name,
          role: DEFAULT_ROLE,
        },
      });

      await tx.contractSettings.create({
        data: {
          userId: createdUser.id,
          weeklyHours: DEFAULT_CONTRACT_SETTINGS.weekly_hours,
          dailyMaxHours: DEFAULT_CONTRACT_SETTINGS.daily_max_hours,
          minRestHours: DEFAULT_CONTRACT_SETTINGS.min_rest_hours,
          overtimeRate: DEFAULT_CONTRACT_SETTINGS.overtime_rate,
        },
      });

      await tx.restRules.create({
        data: {
          userId: createdUser.id,
          preferredRestDays: DEFAULT_REST_RULES.preferred_rest_days,
          preferredTimeOfDay: DEFAULT_REST_RULES.preferred_time_of_day,
          minConsecutiveRestDays: DEFAULT_REST_RULES.min_consecutive_rest_days,
          autoSuggest: DEFAULT_REST_RULES.auto_suggest,
        },
      });

      await tx.defaultWeekSettings.create({
        data: {
          userId: createdUser.id,
          restDays: DEFAULT_WEEK_SETTINGS.rest_days,
          defaultTitle: DEFAULT_WEEK_SETTINGS.default_title,
          defaultType: DEFAULT_WEEK_SETTINGS.default_type,
          morningStart: DEFAULT_WEEK_SETTINGS.morning_start,
          morningEnd: DEFAULT_WEEK_SETTINGS.morning_end,
          afternoonStart: DEFAULT_WEEK_SETTINGS.afternoon_start,
          afternoonEnd: DEFAULT_WEEK_SETTINGS.afternoon_end,
          pauseStart: DEFAULT_WEEK_SETTINGS.pause_start,
          pauseEnd: DEFAULT_WEEK_SETTINGS.pause_end,
          breakMinutes: DEFAULT_WEEK_SETTINGS.break_minutes,
        },
      });

      return createdUser;
    });

    setSessionCookie(res, { id: user.id, email: user.email });
    res.status(201).json({ user: serializeUser({ id: user.id, email: user.email }) });
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/auth/sign-in", async (req, res) => {
  try {
    const payload = z
      .object({
        email: z.string().email(),
        password: z.string().min(1),
      })
      .parse(req.body);

    const email = payload.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: "Identifiants invalides." });
      return;
    }

    const valid = await verifyPassword(payload.password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Identifiants invalides." });
      return;
    }

    setSessionCookie(res, { id: user.id, email: user.email });
    res.json({ user: serializeUser({ id: user.id, email: user.email }) });
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/auth/sign-out", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).send();
});

app.get("/api/settings/bootstrap", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const [profile, contract, rules, defaultWeek, vacations] = await prisma.$transaction([
      prisma.profile.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          fullName: "",
          role: DEFAULT_ROLE,
        },
      }),
      prisma.contractSettings.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          weeklyHours: DEFAULT_CONTRACT_SETTINGS.weekly_hours,
          dailyMaxHours: DEFAULT_CONTRACT_SETTINGS.daily_max_hours,
          minRestHours: DEFAULT_CONTRACT_SETTINGS.min_rest_hours,
          overtimeRate: DEFAULT_CONTRACT_SETTINGS.overtime_rate,
        },
      }),
      prisma.restRules.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          preferredRestDays: DEFAULT_REST_RULES.preferred_rest_days,
          preferredTimeOfDay: DEFAULT_REST_RULES.preferred_time_of_day,
          minConsecutiveRestDays: DEFAULT_REST_RULES.min_consecutive_rest_days,
          autoSuggest: DEFAULT_REST_RULES.auto_suggest,
        },
      }),
      prisma.defaultWeekSettings.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          restDays: DEFAULT_WEEK_SETTINGS.rest_days,
          defaultTitle: DEFAULT_WEEK_SETTINGS.default_title,
          defaultType: DEFAULT_WEEK_SETTINGS.default_type,
          morningStart: DEFAULT_WEEK_SETTINGS.morning_start,
          morningEnd: DEFAULT_WEEK_SETTINGS.morning_end,
          afternoonStart: DEFAULT_WEEK_SETTINGS.afternoon_start,
          afternoonEnd: DEFAULT_WEEK_SETTINGS.afternoon_end,
          pauseStart: DEFAULT_WEEK_SETTINGS.pause_start,
          pauseEnd: DEFAULT_WEEK_SETTINGS.pause_end,
          breakMinutes: DEFAULT_WEEK_SETTINGS.break_minutes,
        },
      }),
      prisma.vacation.findMany({
        where: { userId: user.id },
        orderBy: { startDate: "asc" },
      }),
    ]);

    res.json({
      profile: serializeProfile(profile),
      contract: serializeContract(contract),
      rules: serializeRestRules(rules),
      defaultWeek: serializeDefaultWeek(defaultWeek),
      vacations: vacations.map(serializeVacation),
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.put("/api/settings", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const payload = settingsSchema.parse(req.body);

    const [profile, contract, rules, defaultWeek] = await prisma.$transaction([
      prisma.profile.upsert({
        where: { id: user.id },
        update: {
          fullName: payload.profile.full_name,
          role: payload.profile.role,
        },
        create: {
          id: user.id,
          fullName: payload.profile.full_name,
          role: payload.profile.role,
        },
      }),
      prisma.contractSettings.upsert({
        where: { userId: user.id },
        update: {
          weeklyHours: payload.contract.weekly_hours,
          dailyMaxHours: payload.contract.daily_max_hours,
          minRestHours: payload.contract.min_rest_hours,
          overtimeRate: payload.contract.overtime_rate,
        },
        create: {
          userId: user.id,
          weeklyHours: payload.contract.weekly_hours,
          dailyMaxHours: payload.contract.daily_max_hours,
          minRestHours: payload.contract.min_rest_hours,
          overtimeRate: payload.contract.overtime_rate,
        },
      }),
      prisma.restRules.upsert({
        where: { userId: user.id },
        update: {
          preferredRestDays: payload.rules.preferred_rest_days,
          preferredTimeOfDay: payload.rules.preferred_time_of_day,
          minConsecutiveRestDays: payload.rules.min_consecutive_rest_days,
          autoSuggest: payload.rules.auto_suggest,
        },
        create: {
          userId: user.id,
          preferredRestDays: payload.rules.preferred_rest_days,
          preferredTimeOfDay: payload.rules.preferred_time_of_day,
          minConsecutiveRestDays: payload.rules.min_consecutive_rest_days,
          autoSuggest: payload.rules.auto_suggest,
        },
      }),
      prisma.defaultWeekSettings.upsert({
        where: { userId: user.id },
        update: {
          restDays: payload.defaultWeek.rest_days,
          defaultTitle: payload.defaultWeek.default_title,
          defaultType: payload.defaultWeek.default_type,
          morningStart: payload.defaultWeek.morning_start,
          morningEnd: payload.defaultWeek.morning_end,
          afternoonStart: payload.defaultWeek.afternoon_start,
          afternoonEnd: payload.defaultWeek.afternoon_end,
          pauseStart: payload.defaultWeek.pause_start,
          pauseEnd: payload.defaultWeek.pause_end,
          breakMinutes: payload.defaultWeek.break_minutes,
        },
        create: {
          userId: user.id,
          restDays: payload.defaultWeek.rest_days,
          defaultTitle: payload.defaultWeek.default_title,
          defaultType: payload.defaultWeek.default_type,
          morningStart: payload.defaultWeek.morning_start,
          morningEnd: payload.defaultWeek.morning_end,
          afternoonStart: payload.defaultWeek.afternoon_start,
          afternoonEnd: payload.defaultWeek.afternoon_end,
          pauseStart: payload.defaultWeek.pause_start,
          pauseEnd: payload.defaultWeek.pause_end,
          breakMinutes: payload.defaultWeek.break_minutes,
        },
      }),
    ]);

    res.json({
      profile: serializeProfile(profile),
      contract: serializeContract(contract),
      rules: serializeRestRules(rules),
      defaultWeek: serializeDefaultWeek(defaultWeek),
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.get("/api/activity-types", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const items = await prisma.customActivityType.findMany({
      where: { userId: user.id },
      orderBy: { label: "asc" },
    });
    res.json({ items: items.map(serializeActivityType) });
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/activity-types", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const payload = z
      .object({
        value: z.string().trim().min(1),
        label: z.string().trim().min(1),
      })
      .parse(req.body);

    const activityType = await prisma.customActivityType.create({
      data: {
        userId: user.id,
        value: payload.value,
        label: payload.label,
      },
    });

    res.status(201).json({ item: serializeActivityType(activityType) });
  } catch (error) {
    handleError(res, error);
  }
});

app.get("/api/activities", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const query = z
      .object({
        start: z.string().min(1),
        end: z.string().min(1),
      })
      .parse(req.query);

    const items = await prisma.activity.findMany({
      where: {
        userId: user.id,
        startTime: {
          gte: new Date(query.start),
          lte: new Date(query.end),
        },
      },
      orderBy: { startTime: "asc" },
    });

    res.json({ items: items.map(serializeActivity) });
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/activities", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const payload = activityInputSchema.parse(req.body);

    const activity = await prisma.activity.create({
      data: {
        userId: user.id,
        title: payload.title,
        activityType: payload.activity_type,
        startTime: new Date(payload.start_time),
        endTime: new Date(payload.end_time),
        location: payload.location,
        notes: payload.notes,
        source: payload.source,
        externalId: payload.external_id,
        durationKind: payload.duration_kind,
        breakMinutes: payload.break_minutes,
      },
    });

    res.status(201).json({ item: serializeActivity(activity) });
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/activities/bulk", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const payload = z
      .object({
        items: z.array(activityInputSchema).min(1),
      })
      .parse(req.body);

    const result = await prisma.activity.createMany({
      data: payload.items.map((item) => ({
        userId: user.id,
        title: item.title,
        activityType: item.activity_type,
        startTime: new Date(item.start_time),
        endTime: new Date(item.end_time),
        location: item.location,
        notes: item.notes,
        source: item.source,
        externalId: item.external_id,
        durationKind: item.duration_kind,
        breakMinutes: item.break_minutes,
      })),
    });

    res.status(201).json({ count: result.count });
  } catch (error) {
    handleError(res, error);
  }
});

app.patch("/api/activities/:id", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const payload = activityUpdateSchema.parse(req.body);
    const data: Prisma.ActivityUpdateInput = {};

    if (payload.title !== undefined) data.title = payload.title;
    if (payload.activity_type !== undefined) data.activityType = payload.activity_type;
    if (payload.start_time !== undefined) data.startTime = new Date(payload.start_time);
    if (payload.end_time !== undefined) data.endTime = new Date(payload.end_time);
    if (payload.location !== undefined) data.location = payload.location;
    if (payload.notes !== undefined) data.notes = payload.notes;
    if (payload.source !== undefined) data.source = payload.source;
    if (payload.external_id !== undefined) data.externalId = payload.external_id;
    if (payload.duration_kind !== undefined) data.durationKind = payload.duration_kind;
    if (payload.break_minutes !== undefined) data.breakMinutes = payload.break_minutes;

    const activity = await prisma.activity.update({
      where: { id: params.id, userId: user.id },
      data,
    });

    res.json({ item: serializeActivity(activity) });
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/activities/bulk-update", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const payload = z
      .object({
        updates: z
          .array(
            z.object({
              id: z.string().uuid(),
              data: activityUpdateSchema,
            })
          )
          .min(1),
      })
      .parse(req.body);

    await prisma.$transaction(
      payload.updates.map((update) => {
        const data: Prisma.ActivityUpdateInput = {};
        if (update.data.title !== undefined) data.title = update.data.title;
        if (update.data.activity_type !== undefined) data.activityType = update.data.activity_type;
        if (update.data.start_time !== undefined) data.startTime = new Date(update.data.start_time);
        if (update.data.end_time !== undefined) data.endTime = new Date(update.data.end_time);
        if (update.data.location !== undefined) data.location = update.data.location;
        if (update.data.notes !== undefined) data.notes = update.data.notes;
        if (update.data.source !== undefined) data.source = update.data.source;
        if (update.data.external_id !== undefined) data.externalId = update.data.external_id;
        if (update.data.duration_kind !== undefined) data.durationKind = update.data.duration_kind;
        if (update.data.break_minutes !== undefined) data.breakMinutes = update.data.break_minutes;

        return prisma.activity.update({
          where: { id: update.id, userId: user.id },
          data,
        });
      })
    );

    res.json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
});

app.delete("/api/activities/:id", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    await prisma.activity.delete({ where: { id: params.id, userId: user.id } });
    res.status(204).send();
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/activities/bulk-delete", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const payload = z
      .object({
        ids: z.array(z.string().uuid()).min(1),
      })
      .parse(req.body);

    const result = await prisma.activity.deleteMany({
      where: {
        userId: user.id,
        id: { in: payload.ids },
      },
    });

    res.json({ count: result.count });
  } catch (error) {
    handleError(res, error);
  }
});

app.get("/api/rest-days", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const query = z
      .object({
        start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: restStatusSchema.optional(),
        kind: restKindSchema.optional(),
      })
      .parse(req.query);

    const items = await prisma.restDay.findMany({
      where: {
        userId: user.id,
        restDate: {
          gte: parseDateOnly(query.start),
          lte: parseDateOnly(query.end),
        },
        status: query.status,
        kind: query.kind,
      },
      orderBy: { restDate: "asc" },
    });

    res.json({ items: items.map(serializeRestDay) });
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/rest-days", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const payload = restDayInputSchema.parse(req.body);
    const item = await prisma.restDay.create({
      data: {
        userId: user.id,
        restDate: parseDateOnly(payload.rest_date),
        status: payload.status,
        reason: payload.reason,
        restPeriod: payload.rest_period,
        kind: payload.kind,
      },
    });
    res.status(201).json({ item: serializeRestDay(item) });
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/rest-days/upsert", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const payload = z
      .object({
        rows: z.array(restDayInputSchema).min(1),
      })
      .parse(req.body);

    const rows = await prisma.$transaction(
      payload.rows.map((row) =>
        prisma.restDay.upsert({
          where: {
            userId_restDate: {
              userId: user.id,
              restDate: parseDateOnly(row.rest_date),
            },
          },
          update: {
            status: row.status,
            reason: row.reason,
            restPeriod: row.rest_period,
            kind: row.kind,
          },
          create: {
            userId: user.id,
            restDate: parseDateOnly(row.rest_date),
            status: row.status,
            reason: row.reason,
            restPeriod: row.rest_period,
            kind: row.kind,
          },
        })
      )
    );

    res.json({ items: rows.map(serializeRestDay) });
  } catch (error) {
    handleError(res, error);
  }
});

app.delete("/api/rest-days/:id", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    await prisma.restDay.delete({ where: { id: params.id, userId: user.id } });
    res.status(204).send();
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/rest-days/delete-by-dates", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const payload = z
      .object({
        dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
      })
      .parse(req.body);

    const result = await prisma.restDay.deleteMany({
      where: {
        userId: user.id,
        restDate: {
          in: payload.dates.map(parseDateOnly),
        },
      },
    });

    res.json({ count: result.count });
  } catch (error) {
    handleError(res, error);
  }
});

app.get("/api/vacations", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const items = await prisma.vacation.findMany({
      where: { userId: user.id },
      orderBy: { startDate: "asc" },
    });
    res.json({ items: items.map(serializeVacation) });
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/vacations", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const payload = vacationInputSchema.parse(req.body);
    const item = await prisma.vacation.create({
      data: {
        userId: user.id,
        startDate: parseDateOnly(payload.start_date),
        endDate: parseDateOnly(payload.end_date),
        label: payload.label,
      },
    });

    res.status(201).json({ item: serializeVacation(item) });
  } catch (error) {
    handleError(res, error);
  }
});

app.delete("/api/vacations/:id", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    await prisma.vacation.delete({ where: { id: params.id, userId: user.id } });
    res.status(204).send();
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/imports/boku-kumasala", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const payload = z
      .object({
        since: z.string().optional(),
      })
      .parse(req.body ?? {});

    const result = await importBokuKumasala(user.id, payload.since ?? null);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

app.use((error: unknown, _req: express.Request, res: Response, _next: express.NextFunction) => {
  handleError(res, error);
});

app.listen(env.PORT, () => {
  console.log(`Super Planner API listening on http://localhost:${env.PORT}`);
});