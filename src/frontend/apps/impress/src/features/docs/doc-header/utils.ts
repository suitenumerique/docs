export function downloadFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

const convertToLi = (html: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const divs = doc.querySelectorAll(
    'div[data-content-type="bulletListItem"] , div[data-content-type="numberedListItem"]',
  );

  // Loop through each div and replace it with a li
  divs.forEach((div) => {
    // Create a new li element
    const li = document.createElement('li');

    // Copy the attributes from the div to the li
    for (let i = 0; i < div.attributes.length; i++) {
      li.setAttribute(div.attributes[i].name, div.attributes[i].value);
    }

    // Move all child elements of the div to the li
    while (div.firstChild) {
      li.appendChild(div.firstChild);
    }

    // Replace the div with the li in the DOM
    if (div.parentNode) {
      div.parentNode.replaceChild(li, div);
    }
  });

  /**
   * Convert the blocknote content to a simplified version to be
   * correctly parsed by our pdf and docx parser
   */
  const newContent: string[] = [];
  let currentList: HTMLUListElement | HTMLOListElement | null = null;

  // Iterate over all the children of the bn-block-group
  doc.body
    .querySelectorAll('.bn-block-group .bn-block-outer')
    .forEach((outerDiv) => {
      const blockContent = outerDiv.querySelector('.bn-block-content');

      if (blockContent) {
        const contentType = blockContent.getAttribute('data-content-type');

        if (contentType === 'bulletListItem') {
          // If a list is not started, start a new one
          if (!currentList) {
            currentList = document.createElement('ul');
          }

          currentList.appendChild(blockContent);
        } else if (contentType === 'numberedListItem') {
          // If a numbered list is not started, start a new one
          if (!currentList) {
            currentList = document.createElement('ol');
          }

          currentList.appendChild(blockContent);
        } else {
          /***
           * If there is a current list, add it to the new content
           * It means that the current list has ended
           */
          if (currentList) {
            newContent.push(currentList.outerHTML);
          }

          currentList = null;
          newContent.push(outerDiv.outerHTML);
        }
      } else {
        // In case there is no content-type, add the outerDiv as is
        newContent.push(outerDiv.outerHTML);
      }
    });

  return newContent.join('');
};

const convertToImg = (html: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const divs = doc.querySelectorAll('div[data-content-type="image"]');

  // Loop through each div and replace it with an img
  divs.forEach((div) => {
    const img = document.createElement('img');

    // Copy the attributes from the div to the img
    for (let i = 0; i < div.attributes.length; i++) {
      img.setAttribute(div.attributes[i].name, div.attributes[i].value);

      if (div.attributes[i].name === 'data-url') {
        img.setAttribute('src', div.attributes[i].value);
      }

      if (div.attributes[i].name === 'data-preview-width') {
        img.setAttribute('width', div.attributes[i].value);
      }
    }

    // Move all child elements of the div to the img
    while (div.firstChild) {
      img.appendChild(div.firstChild);
    }

    // Replace the div with the img in the DOM
    if (div.parentNode) {
      div.parentNode.replaceChild(img, div);
    }
  });

  return doc.body.innerHTML;
};

export const adaptBlockNoteHTML = (html: string) => {
  html = html.replaceAll('<p class="bn-inline-content"></p>', '<br/>');

  // custom-style is used by pandoc to convert the style
  html = html.replaceAll(
    /data-text-alignment=\"([a-z]+)\"/g,
    'custom-style="$1"',
  );
  html = html.replaceAll(/data-text-color=\"([a-z]+)\"/g, 'style="color: $1;"');
  html = html.replaceAll(
    /data-background-color=\"([a-z]+)\"/g,
    'style="background-color: $1;"',
  );

  html = convertToLi(html);
  html = convertToImg(html);

  return html;
};
