require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function main() {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.error('GROQ_API_KEY missing');
    process.exit(1);
  }

  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!res.ok) {
    console.error('HTTP', res.status, await res.text());
    process.exit(1);
  }

  const data = await res.json();
  const chat = (data.data || [])
    .map((m) => m.id)
    .filter((id) => !id.includes('whisper') && !id.includes('guard') && !id.includes('tts') && !id.includes('orpheus'))
    .sort();

  console.log('Text/chat models on your account:');
  chat.forEach((id) => console.log(' ', id));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
