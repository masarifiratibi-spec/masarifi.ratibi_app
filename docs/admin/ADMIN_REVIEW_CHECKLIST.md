# Admin Review Checklist

## Automated

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`

## Routes and interaction

- [ ] `/admin`, `/admin/users`, `/admin/imports`, and `/admin/system-health` load
- [ ] Sidebar and mobile drawer navigation work
- [ ] Theme, refresh, search, filters, selection, pagination, drawers, and retry work
- [ ] Default, loading, empty, and error user states render
- [ ] Dialogs close with Escape and return focus appropriately

## Responsive and accessible

- [ ] Review at 1440, 1280, 1024, 768, and 390 pixels
- [ ] Arabic reading order and mixed-direction identifiers are correct
- [ ] Tables become readable card lists on tablet/mobile
- [ ] Charts fit without clipped labels or tooltips
- [ ] Keyboard focus is visible and touch targets are at least 44 pixels
- [ ] Status meaning remains clear without color
- [ ] Reduced-motion preference is respected
- [ ] Light and dark modes retain readable contrast

## Privacy

- [ ] No real identities or bank messages
- [ ] No complete emails, account numbers, balances, salary, debt, or histories
- [ ] User and import drawers repeat the privacy boundary
