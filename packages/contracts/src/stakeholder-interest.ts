import { z } from "zod";

export const stakeholderInterestUsecaseParamsSchema = z.object({
  usecaseId: z.string().min(1)
});

export const stakeholderInterestDeleteParamsSchema =
  stakeholderInterestUsecaseParamsSchema.extend({
    stakeholderInterestId: z.string().min(1)
  });

export const stakeholderInterestRequestSchema = z.object({
  interest: z.string().min(1),
  protection_mechanism: z.string().default(""),
  stakeholder: z.string().min(1)
});

export const storedStakeholderInterestSchema = z.object({
  id: z.string(),
  interest: z.string(),
  protection_mechanism: z.string(),
  stakeholder_id: z.string(),
  usecase_id: z.string()
});

const stakeholderInterestListingSchema = z.object({
  interest: storedStakeholderInterestSchema,
  stakeholder: z.object({ name: z.string() }).loose()
});

const stakeholderInterestRevisionSchema = z
  .object({
    severity: z.string(),
    version_number: z.number()
  })
  .loose();

const stakeholderInterestWarningSchema = z.object({
  message: z.string(),
  type: z.string()
});

export const stakeholderInterestAddResponseSchema = z.object({
  next_missing_role_hint: z.string(),
  revision: stakeholderInterestRevisionSchema,
  stakeholder_interest: storedStakeholderInterestSchema,
  stakeholder_interests: z.array(stakeholderInterestListingSchema)
});

export const stakeholderInterestRemoveResponseSchema = z.object({
  removed_stakeholder_interest_id: z.string(),
  revision: stakeholderInterestRevisionSchema,
  stakeholder_interests: z.array(stakeholderInterestListingSchema),
  warnings: z.array(stakeholderInterestWarningSchema).optional()
});

export type StakeholderInterestRequest = z.infer<
  typeof stakeholderInterestRequestSchema
>;
export type StoredStakeholderInterest = z.infer<typeof storedStakeholderInterestSchema>;
export type StakeholderInterestAddResponse = z.infer<
  typeof stakeholderInterestAddResponseSchema
>;
export type StakeholderInterestRemoveResponse = z.infer<
  typeof stakeholderInterestRemoveResponseSchema
>;
