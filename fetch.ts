async function test() {
  try {
    const res = await fetch('https://api.gdeltproject.org/api/v2/gkg/gkg');
    console.log(res.status);
    const text = await res.text();
    console.log(text.substring(0, 500));
  } catch (e) {
    console.error(e);
  }
}
test();
