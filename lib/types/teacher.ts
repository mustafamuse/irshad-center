import type { Person, PersonWithRelations } from './person'

/**
 * Teacher - Staff role linked to Person
 * A Person can be a teacher while also being a parent, payer, or student
 */
export interface Teacher {
  id: string
  personId: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Teacher with Person relation
 */
export interface TeacherWithPerson extends Teacher {
  person: Person
}

/**
 * Teacher with full Person relations (contact points, etc.)
 */
export interface TeacherWithPersonRelations extends Teacher {
  person: PersonWithRelations
}
