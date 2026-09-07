-- One-time JSON contract migration. WHERE guards also make direct reapplication safe.
UPDATE plans SET data = json_remove(json_set(data,
  '$.members', json(COALESCE((SELECT json_group_array(json_object('kind','owned','pokemonId',value)) FROM json_each(plans.data,'$.memberIds')), '[]')),
  '$.shortlistIds', json(COALESCE(json_extract(data,'$.shortlistIds'), json_extract(data,'$.memberIds'), '[]'))
), '$.memberIds') WHERE json_type(data,'$.memberIds') = 'array' AND json_type(data,'$.members') IS NULL;
UPDATE settings SET data = json_set(data,
  '$.nextBattleId', json_extract(data,'$.nextBattleId'),
  '$.fightReveal', COALESCE(json_extract(data,'$.fightReveal'), CASE json_extract(data,'$.spoilerMode') WHEN 'full' THEN 'full' ELSE 'types' END)
) WHERE id='context';
