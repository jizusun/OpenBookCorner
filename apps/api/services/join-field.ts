import { and, eq } from 'drizzle-orm'

import { joinField, type Database, type JoinField } from '@obc/db'

export class JoinFieldService {
  constructor(private db: Database) {}

  async list(libraryId: string): Promise<JoinField[]> {
    const rows =
      (await this.db.select().from(joinField).where(eq(joinField.libraryId, libraryId)).all?.()) ?? []
    return rows.sort((a, b) => a.position - b.position)
  }

  async create(
    libraryId: string,
    input: {
      key: string
      label: string
      type: 'text' | 'email' | 'select'
      required?: boolean
      verifyEmail?: boolean
      options?: string[]
      allowedDomains?: string[]
    },
  ): Promise<JoinField> {
    const existing = await this.list(libraryId)
    const position = existing.length
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await this.db.insert(joinField).values({
      id,
      libraryId,
      key: input.key,
      label: input.label,
      type: input.type,
      required: input.required ?? true,
      verifyEmail: input.verifyEmail ?? false,
      options: input.options ?? null,
      allowedDomains: input.allowedDomains ?? null,
      position,
      createdAt: now,
    })
    return { id, libraryId, key: input.key, label: input.label, type: input.type,
      required: input.required ?? true, verifyEmail: input.verifyEmail ?? false,
      options: input.options ?? null, allowedDomains: input.allowedDomains ?? null,
      position, createdAt: now }
  }

  async update(
    fieldId: string,
    libraryId: string,
    patch: Partial<Pick<JoinField, 'label' | 'required' | 'verifyEmail' | 'options' | 'allowedDomains'>>,
  ): Promise<void> {
    await this.db
      .update(joinField)
      .set(patch)
      .where(and(eq(joinField.id, fieldId), eq(joinField.libraryId, libraryId)))
  }

  async remove(fieldId: string, libraryId: string): Promise<void> {
    await this.db
      .delete(joinField)
      .where(and(eq(joinField.id, fieldId), eq(joinField.libraryId, libraryId)))
  }
}
