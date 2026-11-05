// @ts-nocheck -- Bulk rename done by wh devkit:es2ts

//At minimum, activates required CSS and JSON/RPC links
import * as forms from '@mod-publisher/js/forms';
import * as dompack from 'dompack';
import './styles.scss';
import { cSplitDateInput, cSplitTimeInput } from '../../shared/splitdatetimeinput';
import UploadField from '@mod-publisher/js/forms/fields/upload';
import ImgEditField from '@mod-publisher/js/forms/fields/imgedit';
import RTDField from '@mod-publisher/js/forms/fields/rtd';

//Enable forms and our builtin validation
forms.setup({ validate: true });

dompack.register(".wh-form__upload", node => new UploadField(node));
dompack.register(".wh-form__imgedit", node => new ImgEditField(node));
dompack.register(".wh-form__rtd", node => new RTDField(node));
dompack.register(".wh-styledinput input[type=time]", node => new cSplitTimeInput(node));
dompack.register(".wh-styledinput input[type=date]", node => new cSplitDateInput(node));

//Styled pulldown: add wrapper around select element + arrow for css-styling
dompack.register(".wh-form select", selectnode => {
  const wrappernode = <div class="wh-form__pulldown-styled" />;
  selectnode.parentNode.insertBefore(wrappernode, selectnode);
  wrappernode.appendChild(selectnode);
  wrappernode.appendChild(<span class="arrow fa fa-angle-down" />);
});
