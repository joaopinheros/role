# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Single self-contained HTML page published as a claude.ai artifact (vanilla JS + canvas, no build step). Data via the artifact `db`/`user`/`room` capabilities, with a localStorage fallback.

## Users

Friend groups aged roughly 25–35 in Brazil who organise get-togethers ("rolês"): barbecues, house parties, sleepovers, bar nights, beach luaus. The organiser creates the event and shares a link in the group chat; the invited friends open it on their phones, sign up once and drop into a shared virtual room.

## Product Purpose

Rolê turns an event invite into a place. Instead of a text with date and address, the group gets a small isometric pixel-art room themed after the event, where everyone shows up as a dressable avatar, walks around, chats, sits, dances and hears house music before and during the real thing. Success: the organiser creates and shares a rolê in under a minute, and invitees accept and land in the room without friction.

## Positioning

A Habbo-style social room per event, with Y2K-fashion pixel avatars, instead of a generic RSVP form. The room *is* the invitation.

## Operating Context

- Links are pasted into WhatsApp/Instagram group chats and opened mostly on phones.
- Flow: sign up (name, @user, e-mail, phone) → confirm phone with a 4-digit code (simulated SMS in the MVP) → home → create rolê (name, date, time → pick one of 11 places, day or night → copy link) → invitee opens link → "you were invited" card → accept → sign up/login → room.
- In the room: chat, actions (dance, wave, sit, stand up), live presence, pets, a DJ mixer that plays generated house music, a wardrobe drawer.

## Capabilities and Constraints

- 11 places: backyard with porch, house party, sleepover, park with lake, club, corner bar (boteco), pool house, volcano island, temple with koi pond, beach luau, city rooftop. Each has day and night.
- Avatar: layered pixel-art body (two body bases, three builds, three heights, 7 skin tones), ~12 hairstyles, 7 expressions, ~60 clothing and accessory items in 11 slots, recolourable.
- Must keep working: auth and verification flow, invite links (`#r-<id>`), pending-invite persistence, presence and chat, wardrobe save, music toggle.
- SMS is simulated; invitees need contributor access to the artifact to write data.

## Brand Commitments

- Name: **Rolê**. Language: Brazilian Portuguese, informal but direct (25–35 audience: friendly, light slang, no heavy slang).
- The world is pixel art (avatars, rooms, pets). The interface must belong to the same retro-gaming / Y2K universe.
- User explicitly wants to move away from anything that reads as "Claude's look" (warm dark panels, Silkscreen + Chivo, soft glass boxes) and from vibe-coded templates. Requested direction: Neo-Brutalism with Pixel Art / Retro Gaming Y2K, balanced (structure brutalist, colour on key points, room to breathe). Screen background follows the scene: light and colourful by day, dark by night.

## Evidence on Hand

No real users, testimonials, metrics or press yet. Do not invent counts, ratings or quotes.

## Product Principles

1. The room is the hero: UI frames the pixel world, never hides it.
2. One-thumb flows: every step works on a phone held in one hand.
3. Say what happens: buttons name the result ("Criar rolê", "Copiar link", "Entrar no rolê").
4. Playful, not childish: the audience is adults who grew up with 2000s games and fashion.

## Accessibility & Inclusion

Readable contrast over busy pixel backgrounds, visible keyboard focus, reduced-motion respected, touch targets ≥ 44px.
