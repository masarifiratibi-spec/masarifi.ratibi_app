// Operational canary checks only. Never infers or edits a financial category.
function inspectCategory(value, references, expectedCategoryId) {
  const selected = typeof value === "string" && value.length > 0;
  const matches = selected
    ? references.filter(
        (item) =>
          item.kind === "category" &&
          (item.alias === value || item.id === value),
      )
    : [];
  const match = matches.length === 1 ? matches[0] : undefined;
  const expense = match?.data?.kind === "expense";
  const expectedReferences = references.filter(
    (item) => item.id === expectedCategoryId,
  );
  const expected = Boolean(
    match &&
    expectedReferences.length === 1 &&
    expectedReferences[0].kind === "category" &&
    expectedReferences[0].data?.kind === "expense" &&
    match.id === expectedCategoryId,
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
