const MINIMUM_MEMBER_AGE = 18;
const MAXIMUM_MEMBER_AGE = 120;

function yearsAgo(years: number) {
  const today = new Date();
  return new Date(
    today.getFullYear() - years,
    today.getMonth(),
    today.getDate(),
    12,
  );
}

export function dateOfBirthLimits() {
  return {
    maximumDate: yearsAgo(MINIMUM_MEMBER_AGE),
    minimumDate: yearsAgo(MAXIMUM_MEMBER_AGE),
  };
}

export function defaultDateOfBirth() {
  return yearsAgo(30);
}

export function parseDateOfBirth(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(year, month - 1, day, 12);

  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  ) {
    return null;
  }

  return result;
}

export function toDateOfBirthValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isEligibleDateOfBirth(value: string) {
  const parsed = parseDateOfBirth(value);

  if (!parsed) {
    return false;
  }

  const { minimumDate, maximumDate } = dateOfBirthLimits();
  return parsed >= minimumDate && parsed <= maximumDate;
}

export function formatDateOfBirth(value: string) {
  const parsed = parseDateOfBirth(value);

  if (!parsed) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export function ageFromDateOfBirth(value: string) {
  const parsed = parseDateOfBirth(value);

  if (!parsed) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const beforeBirthday =
    today.getMonth() < parsed.getMonth() ||
    (today.getMonth() === parsed.getMonth() &&
      today.getDate() < parsed.getDate());

  if (beforeBirthday) {
    age -= 1;
  }

  return age;
}
