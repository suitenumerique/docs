import axios from 'axios';

function escapeMermaidSpecialChars(text: string): string {
  return text
    .replace(/\\/g, '\\\\')  // escape backslashes
    .replace(/\//g, '\\/')   // escape slashes
    .replace(/\(/g, '\\(')   // escape (
    .replace(/\)/g, '\\)');  // escape )
}

export async function callAlbertAI(blockType: string, request: string): Promise<string> {
  let prompt = '';
  if (blockType == 'latex') {
    prompt = `Produce the LateX code from a simple sentence, follow these steps : \n 
        1. Translate the sentence into one single math sentence or equation, it should only have math symbols NO TEXT \n 
        2. Convert that math sentence into a single sentence of LateX code \n 
        3. Don't repeat multiple times the same sentence \n
        4. The LateX output SHOULD NOT include metadata declarations \n
        4. TO AVOID IF POSSIBLE You can only use the align or multiline environment if you need multiple lines. 
        5. Return only the code without indocution sentence, without, the code should only include equations\n
        \n
        Sentence :${request}`;
  } else if (blockType == 'mermaid') {
    const prompt = `Produce the Mermaid code from a graph, follow these steps : \n 
        1. Use the sentence to develop logically organized bullet points and connections \n 
        2. Use the Mermaid syntax to create a flowchart, sequence diagram, or class diagram as appropriate, bear in mind that the diagram should be higher than wide \n
        3. Don't repeat multiple times the same sentence\n
        4. The Mermaid output SHOULD NOT include metadata declarations, DO NOT ENCLOSE CODE IN \\\` or mermaid statement \n
        5. Return only the code without introduction sentence, without, the code should only include diagrams, NO OTHER TEXT\n
        6. PAY ATTENTION TO THE SYNTAX, some characters need special syntax to be used as labels, characters like \\ / and () need to be signaled\n
        7. The output should be a valid Mermaid code that can be rendered in a Mermaid live editor \n
        8. DO NOT ENCLOSE CODE IN \\\` or mermaid statement \n
        \n"
        Sentence :${request}`;
  } else {
        return 'Unsupported block type';
    };

  const response = await axios.post(
    'https://albert.api.etalab.gouv.fr/v1',
    {
      model : 'albert-large',
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  var latexResponse = response.data.choices[0].message.content.trim();
  // Clean up response if latex
  if (blockType === 'latex') {
    latexResponse = latexResponse.replace(/^\s*\$+|\$+\s*$/g, '');
  } else if (blockType === 'mermaid') {
    latexResponse = latexResponse.replace(/^\s*mermaid\s*|\s*$/g, '');
    latexResponse = escapeMermaidSpecialChars(latexResponse);
  }
  return latexResponse;
}