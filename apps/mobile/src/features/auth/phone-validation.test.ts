import { validatePhoneInput } from './phone-validation';

describe('validatePhoneInput', () => {
  it.each([
    [{ countryCode: '', phoneValue: '' }, 'appShell.auth.phone.invalid'],
    [{ countryCode: '+999', phoneValue: '5550100' }, 'appShell.auth.phone.invalid'],
    [{ countryCode: '+20', phoneValue: 'abc' }, 'appShell.auth.phone.invalid']
  ])('rejects invalid phone input %#', (input, errorCode) => {
    expect(validatePhoneInput(input)).toEqual({ success: false, errorCode });
  });

  it('accepts supported mixed-direction values and normalizes digits', () => {
    expect(
      validatePhoneInput({ countryCode: '+966', phoneValue: '\u200f555 0100' })
    ).toEqual({
      success: true,
      data: { countryCode: '+966', phoneValue: '5550100' }
    });
  });
});
