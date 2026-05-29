import schemaJson from "@/schema.json";

// This module is the single source of truth for enums and profile typing.
// All option lists and literal unions are derived from `schema.json` (no hardcoded enums).

type Schema = typeof schemaJson;

function assertEnumArray(value: unknown): asserts value is readonly string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new Error("schema.json enum is missing or invalid");
  }
}

const programmeEnum =
  (schemaJson.properties.user as Schema["properties"]["user"]).properties
    .programme.enum;
assertEnumArray(programmeEnum);
export const PROGRAMMES = programmeEnum;
export type Programme = (typeof PROGRAMMES)[number];

const programmeYearEnum =
  (schemaJson.properties.user as Schema["properties"]["user"]).properties
    .programme_year.enum;
assertEnumArray(programmeYearEnum);
export const PROGRAMME_YEARS = programmeYearEnum;
export type ProgrammeYear = (typeof PROGRAMME_YEARS)[number];

const industryEnum =
  (schemaJson.properties.user as Schema["properties"]["user"]).properties
    .current_industry.enum;
assertEnumArray(industryEnum);
export const INDUSTRIES = industryEnum;
export type Industry = (typeof INDUSTRIES)[number];

const interviewStageEnum =
  (schemaJson.properties.user as Schema["properties"]["user"]).properties
    .interview_stage.enum;
assertEnumArray(interviewStageEnum);
export const INTERVIEW_STAGES = interviewStageEnum;
export type InterviewStage = (typeof INTERVIEW_STAGES)[number];

const assessmentModeEnum = schemaJson.properties.assessment_mode.enum;
assertEnumArray(assessmentModeEnum);
export const ASSESSMENT_MODES = assessmentModeEnum;
export type AssessmentMode = (typeof ASSESSMENT_MODES)[number];

const outputFormatEnum = schemaJson.properties.output_format.items.enum;
assertEnumArray(outputFormatEnum);
export const OUTPUT_FORMATS = outputFormatEnum;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

const skills = (schemaJson.properties.user as Schema["properties"]["user"])
  .properties.skills_self_reported.properties;

const daa = skills.data_and_analytics.items.enum;
assertEnumArray(daa);
export const SKILLS_DATA_AND_ANALYTICS = daa;
export type SkillDataAndAnalytics = (typeof SKILLS_DATA_AND_ANALYTICS)[number];

const aiml = skills.ai_and_ml.items.enum;
assertEnumArray(aiml);
export const SKILLS_AI_AND_ML = aiml;
export type SkillAiAndMl = (typeof SKILLS_AI_AND_ML)[number];

const finance = skills.finance.items.enum;
assertEnumArray(finance);
export const SKILLS_FINANCE = finance;
export type SkillFinance = (typeof SKILLS_FINANCE)[number];

const tech = skills.technology.items.enum;
assertEnumArray(tech);
export const SKILLS_TECHNOLOGY = tech;
export type SkillTechnology = (typeof SKILLS_TECHNOLOGY)[number];

const soft = skills.soft_skills.items.enum;
assertEnumArray(soft);
export const SKILLS_SOFT_SKILLS = soft;
export type SkillSoftSkills = (typeof SKILLS_SOFT_SKILLS)[number];

export type SkillsSelfReported = {
  data_and_analytics: SkillDataAndAnalytics[];
  ai_and_ml: SkillAiAndMl[];
  finance: SkillFinance[];
  technology: SkillTechnology[];
  soft_skills: SkillSoftSkills[];
};

export type UserProfileUser = {
  programme: Programme;
  programme_year: ProgrammeYear;
  current_industry: Industry;
  target_industry: Industry;
  current_role: string;
  target_role: string;
  years_experience: number;
  skills_self_reported: SkillsSelfReported;
  interview_stage: InterviewStage;
  target_companies?: string[];
};

export type UserProfileMetadata = {
  created_at: string;
  updated_at: string;
  session_id: string;
  onboarding_complete: boolean;
};

export type UserProfile = {
  user: UserProfileUser;
  assessment_mode: AssessmentMode;
  output_format: OutputFormat[];
  metadata: UserProfileMetadata;
};

export const DEFAULT_ASSESSMENT_MODE: AssessmentMode = "full";

// Default output format follows the schema’s enum order, minus modules not yet built
// (risk_score has no implementation — see jobs/interview/github features only).
export const DEFAULT_OUTPUT_FORMAT: OutputFormat[] = OUTPUT_FORMATS.filter(
  (f) => f !== "risk_score",
).slice(0, 5);

