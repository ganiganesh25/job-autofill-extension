import { z } from 'zod'

export const workExperienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  location: z.string().optional(),
  startDate: z.string().optional(), // free-form, e.g. "Jan 2022"
  endDate: z.string().optional(), // omitted/empty means "present"
  description: z.string().optional(),
})

export const educationSchema = z.object({
  institution: z.string(),
  degree: z.string().optional(),
  fieldOfStudy: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export const profileSchema = z.object({
  fullName: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  location: z.string().optional(),
  // Separate from `location` because ATS forms ask for them separately —
  // Greenhouse renders Country as its own required combobox.
  country: z.string().optional(),
  links: z
    .object({
      linkedin: z.string().url().optional(),
      github: z.string().url().optional(),
      portfolio: z.string().url().optional(),
      other: z.array(z.string().url()).optional(),
    })
    .optional(),
  summary: z.string().optional(),
  skills: z.array(z.string()).default([]),
  workExperience: z.array(workExperienceSchema).default([]),
  education: z.array(educationSchema).default([]),
  // Free-text source, retained so answer generation has full context beyond
  // the structured fields above.
  rawResumeText: z.string().optional(),
})

export type Profile = z.infer<typeof profileSchema>
export type WorkExperience = z.infer<typeof workExperienceSchema>
export type Education = z.infer<typeof educationSchema>

export const emptyProfile: Profile = {
  fullName: '',
  email: '',
  skills: [],
  workExperience: [],
  education: [],
}

/** Validates unknown data (e.g. AI-extracted JSON) against the profile shape. */
export function parseProfile(data: unknown): Profile {
  return profileSchema.parse(data)
}

export function safeParseProfile(data: unknown) {
  return profileSchema.safeParse(data)
}
