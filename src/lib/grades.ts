// French sport grades, ordered hardest-last. Sort routes by index into this
// array. Extend the array if a grade outside the range ever appears.
export const GRADES = [
  '4',
  '4+',
  '5',
  '5+',
  '6a',
  '6a+',
  '6b',
  '6b+',
  '6c',
  '6c+',
  '7a',
  '7a+',
  '7b',
  '7b+',
  '7c',
  '7c+',
  '8a',
] as const

export type Grade = (typeof GRADES)[number]

export const gradeIndex = (grade: Grade): number => GRADES.indexOf(grade)

// finalGrade wins once a route has been regraded; initialGrade is the setter's
// guess and is always present.
export const officialGrade = (route: { initialGrade: Grade; finalGrade?: Grade }): Grade =>
  route.finalGrade ?? route.initialGrade
