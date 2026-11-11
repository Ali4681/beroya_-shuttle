import { parentAbsenceMessages } from './passenger.rules';

describe('parentAbsenceMessages', () => {
  it('builds Arabic and English banner copy with the student name', () => {
    expect(parentAbsenceMessages('عمر خالد')).toEqual({
      messageAr: 'اعتذر ولي أمر الطالب (عمر خالد) عن حضور ابنه اليوم.',
      messageEn:
        'The guardian of student (عمر خالد) reported absence for today.',
    });
  });
});
