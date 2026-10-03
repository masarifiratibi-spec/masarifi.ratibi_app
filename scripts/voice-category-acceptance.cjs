// Operational canary checks only. Never infers or edits a financial category.
function inspectCategory(value, references) {
  const selected = typeof value === "string" && value.length > 0;
  const match = selected
    ? references.find(
        (item) =>
          item.kind === "category" &&
          (item.alias === value || item.id === value),
      )
    : undefined;
  const expense = match?.data?.kind === "expense";
  const expected = Boolean(
    match && /grocer|بقال|تسوق/i.test(JSON.stringify(match.data)),
  );
  return {
    categorySelected: selected,
    categoryReferenceKnown: Boolean(match),
    categoryExpense: expense,
    categoryExpected: expected,
    categoryCorrect: Boolean(selected && match && expense && expected),
  };
}
module.exports = { inspectCategory };
